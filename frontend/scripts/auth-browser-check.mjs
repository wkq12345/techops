// Checks the running local app. Credentials stay in memory and are never logged.
// Does not create staff accounts or change passwords.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

const profile = await mkdtemp(join(tmpdir(), 'techops-auth-check-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket
try {
  let port
  for (let i = 0; i < 60; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await pause(100) } }
  assert.ok(port, 'Review browser did not start')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  let sequence = 0
  const pending = new Map()
  const authResponses = []
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, 15000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })) })
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/api/v1/auth/')) authResponses.push({ path: new URL(message.params.response.url).pathname, status: message.params.response.status }); if (!message.id) return; const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item?.timer); if (message.error) item?.reject(new Error('Browser command failed')); else item?.resolve(message.result) })
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error('Browser evaluation failed'); return result.result.value }
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(150) } throw new Error('The expected authentication state did not appear') }
  const fill = async (selector, value) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause(100) }
  await send('Page.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://localhost:5173/modules/products?source=auth-check' })
  await until(`location.pathname==='/login' && Boolean(document.querySelector('input[type="email"]'))`)
  console.log('Anonymous private-page access redirects to staff login')
  if (process.argv.includes('--login')) {
    const env = parseEnv(await readFile('../backend/.env', 'utf8'))
    const email = process.env.TECHOPS_TEST_EMAIL || env.ADMIN_EMAIL || 'admin@techops.local'
    const password = process.env.TECHOPS_TEST_PASSWORD || env.ADMIN_PASSWORD || 'ChangeMe123!'
    await fill('input[type="email"]', email)
    await fill('input[type="password"]', password)
    await evaluate(`document.querySelector('button[type="submit"]').click()`)
    try { await until(`location.pathname==='/modules/products' && Boolean(document.querySelector('.sidebar'))`) } catch (error) { console.log(JSON.stringify({ responses: authResponses, feedback: await evaluate(`document.querySelector('[role="alert"]')?.textContent || [...document.querySelectorAll('.field small')].map(e=>e.textContent).join('; ')`) })); throw error }
    assert.equal(await evaluate(`location.search`), '?source=auth-check')
    const cookies = await send('Network.getCookies', { urls: ['http://localhost:8000'] })
    assert.ok(cookies.cookies.some(cookie => cookie.httpOnly && cookie.name.includes('session')), 'No HTTP-only session cookie found')
    await send('Page.reload')
    await until(`location.pathname==='/modules/products' && Boolean(document.querySelector('.sidebar'))`)
    console.log('Real cookie login, return URL and session persistence verified')
    if (process.argv.includes('--modals')) {
      const openDialog = async (button, title) => {
        await until(`Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(button)}))`)
        await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(button)});b.focus();b.click()})()`)
        await until(`document.querySelector('dialog:modal h2')?.textContent===${JSON.stringify(title)}`)
        assert.equal(await evaluate(`Boolean(document.querySelector('main form'))`), false, 'Form still renders inline')
        if (process.argv.includes('--codes') && (title.startsWith('Create') || title === 'Edit product')) {
          assert.equal(await evaluate(`Boolean(document.querySelector('dialog input.generated-code[readonly]'))`), true, 'Business code is editable')
          assert.equal(await evaluate(`document.querySelector('dialog input.generated-code').required`), false, 'Business code is required from staff')
          if (title.startsWith('Create')) assert.equal(await evaluate(`document.querySelector('dialog input.generated-code').placeholder`), 'Auto-generated on save')
          else assert.ok(await evaluate(`document.querySelector('dialog input.generated-code').value`), 'Existing code was not displayed')
        }
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
        await until(`!document.querySelector('dialog')`)
      }
      await openDialog('New product', 'Create product')
      await until(`Boolean([...document.querySelectorAll('tbody button')].find(b=>b.textContent.trim()==='Edit'))`)
      await openDialog('Edit', 'Edit product')
      if (process.argv.includes('--codes')) {
        for (const resource of ['customers', 'suppliers', 'warehouses', 'warranties']) {
          await send('Page.navigate', { url: `http://localhost:5173/modules/${resource}` })
          await openDialog('New record', `Create ${resource}`)
        }
        console.log('All five staff-facing generated-code forms are read-only and do not require manual codes')
      }
      if (process.argv.includes('--sales-categories')) {
        await send('Page.navigate', { url: 'http://localhost:5173/modules/sales-orders' })
        await until(`Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New sales order'))`)
        await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New sales order');b.focus();b.click()})()`)
        await until(`Boolean(document.querySelector('dialog .sales-order-item > label:first-child select option[value]:not([value=""])')) && !document.querySelector('dialog .product-picker select').disabled`)
        const alignment = await evaluate(`[...document.querySelectorAll('dialog form > .order-form-grid:first-child select')].map(e=>e.getBoundingClientRect().top)`)
        assert.ok(Math.abs(alignment[0] - alignment[1]) < 1, 'Live customer/warehouse controls are misaligned')
        await evaluate(`(()=>{const e=document.querySelector('dialog .sales-order-item > label:first-child select');e.value=e.options[1].value;e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
        await until(`!document.querySelector('dialog .product-picker select').disabled`)
        const matching = await evaluate(`(async()=>{const category=document.querySelector('dialog .sales-order-item > label:first-child select').value;const response=await fetch('http://localhost:8000/api/v1/products?status=active&per_page=100&category_id='+category,{credentials:'include'});const body=await response.json();return {status:response.status,expected:body.data.map(p=>String(p.id)),shown:[...document.querySelector('dialog .product-picker select').options].map(o=>o.value).filter(Boolean)}})()`)
        assert.equal(matching.status, 200)
        assert.deepEqual(matching.shown, matching.expected, 'Live product choices do not match the filtered API')
        await evaluate(`document.querySelector('dialog [aria-label="Close dialog"]').click()`)
        await until(`!document.querySelector('dialog')`)
        console.log('Real sales category filtering and aligned customer/warehouse controls verified without creating an order')
      }
      await send('Page.navigate', { url: 'http://localhost:5173/modules/inventory' })
      await openDialog('Adjust stock', 'Adjust stock')
      await openDialog('Transfer stock', 'Transfer stock')
      await send('Page.navigate', { url: 'http://localhost:5173/account' })
      await openDialog('Change password', 'Change password')
      console.log('Real authenticated product, inventory and account modals verified without saving records')
    }
    if (process.argv.includes('--categories')) {
      await send('Page.navigate', { url: 'http://localhost:5173/modules/categories' })
      await until(`Boolean(document.querySelector('nav a[href="/modules/categories"]')) && Boolean(document.querySelector('tbody tr'))`)
      const listing = await evaluate(`(async()=>{const response=await fetch('http://localhost:8000/api/v1/categories',{credentials:'include'});const body=await response.json();return {status:response.status,valid:body.data.every(row=>Number.isInteger(row.products_count)&&Number.isInteger(row.children_count)&&'parent' in row)}})()`)
      assert.equal(listing.status, 200)
      assert.equal(listing.valid, true, 'Category API is missing parent or usage information')
      for (const [button, title] of [['New category', 'Create category'], ['Edit', 'Edit category'], ['Delete', 'Delete category']]) {
        await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(button)});b.focus();b.click()})()`)
        await until(`document.querySelector('dialog:modal h2')?.textContent===${JSON.stringify(title)}`)
        assert.equal(await evaluate(`Boolean(document.querySelector('main form'))`), false)
        await evaluate(`document.querySelector('dialog [aria-label="Close dialog"]').click()`)
        await until(`!document.querySelector('dialog')`)
      }
      console.log('Live Categories navigation, listing, create/edit/delete confirmation modals verified without saving or deleting records')
    }
    if (process.argv.includes('--alignment')) {
      const paths = await evaluate(`[...document.querySelectorAll('nav a[href^="/modules/"]')].map(a=>a.getAttribute('href')).filter(path=>!path.endsWith('/reports'))`)
      for (const path of paths) {
        await send('Page.navigate', { url: 'http://localhost:5173' + path })
        await until(`Boolean(document.querySelector('.data-table')) || (Boolean(document.querySelector('.table-state')) && !document.querySelector('.table-state').textContent.includes('Loading'))`)
        const result = await evaluate(`(()=>{const panel=document.querySelector('.table-panel'),heading=document.querySelector('.workspace-heading');const table=document.querySelector('.data-table');const headers=table?[...table.querySelectorAll('thead th')]:[];return {gutter:Math.abs(panel.getBoundingClientRect().left-heading.getBoundingClientRect().left)<1,failed:table?[...table.querySelectorAll('tbody tr')].flatMap(row=>[...row.cells].filter((cell,i)=>{const h=getComputedStyle(headers[i]),c=getComputedStyle(cell);return h.textAlign!==c.textAlign||h.paddingLeft!==c.paddingLeft||h.paddingRight!==c.paddingRight})).length:0,error:Boolean(document.querySelector('.table-state.error-text'))}})()`)
        assert.equal(result.gutter, true, `Inconsistent page gutters: ${path}`)
        assert.equal(result.failed, 0, `Table alignment mismatch: ${path}`)
        const equalColumns = await evaluate(`(()=>{const cells=[...document.querySelectorAll('.data-table thead th')];if(!cells.length)return true;const widths=cells.map(cell=>cell.getBoundingClientRect().width);return Math.max(...widths)-Math.min(...widths)<1})()`)
        assert.equal(equalColumns, true, `Unequal table column widths: ${path}`)
        const centered = await evaluate(`(()=>{return [...document.querySelectorAll('.data-table tbody .table-centered-cell,.data-table tbody .table-actions-cell')].every(cell=>{const r=cell.getBoundingClientRect(),center=r.left+r.width/2,badge=cell.querySelector('.ui-status');if(getComputedStyle(cell).textAlign!=='center')return false;if(badge){const b=badge.getBoundingClientRect();if(Math.abs(b.left+b.width/2-center)>1)return false}const rects=[...cell.querySelectorAll('button,a.ui-button')].map(b=>b.getBoundingClientRect());return !rects.length||Math.abs((Math.min(...rects.map(r=>r.left))+Math.max(...rects.map(r=>r.right)))/2-center)<1})})()`)
        assert.equal(centered, true, `Status or actions are off-center: ${path}`)
        assert.equal(result.error, false, `Module failed to load: ${path}`)
      }
      console.log(`Live header/cell alignment and page gutters verified across ${paths.length} modules without business-data writes`)
    }
    await evaluate(`document.querySelector('[aria-label="Sign out"]').click()`)
    await until(`location.pathname==='/login' && Boolean(document.querySelector('input[type="email"]'))`)
    await send('Page.navigate', { url: 'http://localhost:5173/modules/inventory' })
    await until(`location.pathname==='/login' && Boolean(document.querySelector('input[type="email"]'))`)
    console.log('Logout revokes the session and blocks subsequent private-page access')
  }
} finally { socket?.close(); chrome.kill(); await pause(300); await rm(profile, { recursive: true, force: true }).catch(() => {}) }
