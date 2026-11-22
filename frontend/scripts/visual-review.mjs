// Isolated browser fixtures for visual review; no database requests or writes.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const page = process.argv[2] || 'dashboard', mobile = process.argv[3] === 'mobile'
const createAction = page === 'categories' ? 'New category' : page === 'sales-orders' ? 'New sales order' : page === 'inventory' ? 'Adjust stock' : 'New product'
const profile = await mkdtemp(join(tmpdir(), 'techops-review-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=9337', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket
try {
  let targets
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9337/json')).json(); break } catch { await pause(200) } }
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  let sequence = 0
  const pending = new Map()
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
  const products = [
    { id: 1, sku: 'CPU-AMD-7800', name: 'AMD Ryzen 7 7800X3D', product_type: 'physical', tracking_type: 'quantity', selling_price: '1699.00', cost_price: '1400', status: 'active' },
    { id: 2, sku: 'RAM-KST-32', name: 'Kingston Fury 32GB DDR5', product_type: 'physical', tracking_type: 'quantity', selling_price: '429.00', status: 'active' },
    { id: 3, sku: 'SSD-SAM-1TB', name: 'Samsung 990 PRO 1TB', product_type: 'physical', tracking_type: 'quantity', selling_price: '549.00', status: 'active' },
    { id: 4, sku: 'NB-LEN-T14', name: 'Lenovo ThinkPad T14', product_type: 'serialized', tracking_type: 'serial', selling_price: '4599.00', status: 'active' },
    { id: 5, sku: 'SVC-DIAG', name: 'Device diagnostic service', product_type: 'service', tracking_type: 'none', selling_price: '80.00', status: 'active' },
    { id: 6, sku: 'GPU-RTX-3060', name: 'GeForce RTX 3060 12GB', product_type: 'serialized', tracking_type: 'serial', selling_price: '1199.00', status: 'inactive' },
  ]
  products.forEach((product, index) => { product.category_id = [11, 12, 13, 20, null, 11][index] })
  const fixtures = {
    '/api/v1/categories': [{ id: 10, name: 'Components', parent_id: null, status: 'active' }, { id: 11, name: 'CPUs', parent_id: 10, status: 'active' }, { id: 12, name: 'Memory', parent_id: 10, status: 'active' }, { id: 13, name: 'Storage', parent_id: 10, status: 'active' }, { id: 20, name: 'Computers', parent_id: null, status: 'active' }],
    '/api/v1/customers': [{ id: 1, name: 'Sample customer', customer_code: 'CUS-000001' }],
    '/api/v1/inventory-units': [{ id: 1, product_id: 4, warehouse_id: 1, serial_number: 'REVIEW-SERIAL', status: 'available' }],
    '/api/v1/auth/user': { id: 1, name: 'Operations Admin', roles: ['super-admin'], permissions: ['reports.view', 'inventory.view', 'products.view', 'sales.create', 'repairs.view', 'purchases.create'] },
    '/api/v1/reports/dashboard': { sales: { orders: 126, completed: 104, revenue: 98450 }, inventory: { low_stock: 7, quantity_value: 184250, serialized_available: 24 }, repairs: { active: 18, total: 89, revenue: 9400 }, purchasing: { outstanding: 6, spend: 84200 } },
    '/api/v1/sales-orders': [{ id: 1, number: 'SO-2026-00126', status: 'confirmed', total: '3428', created_at: '2026-10-07T10:00:00Z' }, { id: 2, number: 'SO-2026-00125', status: 'processing', total: '1699', created_at: '2026-10-07T09:30:00Z' }],
    '/api/v1/repairs': [{ id: 1, number: 'REP-2026-00089', status: 'awaiting_parts', estimated_cost: '280', created_at: '2026-10-07T08:00:00Z' }, { id: 2, number: 'REP-2026-00088', status: 'ready_for_collection', estimated_cost: '150', created_at: '2026-10-07T07:00:00Z' }],
    '/api/v1/purchase-orders': [{ id: 1, number: 'PO-2026-00034', status: 'pending_approval', total: '8450', created_at: '2026-10-07T06:00:00Z' }],
    '/api/v1/inventory': products.slice(0, 4).map((p, i) => ({ id: i + 1, product_id: p.id, sku: p.sku, product_name: p.name, warehouse_id: 1, warehouse_name: 'Main warehouse', quantity: [12, 28, 3, 2][i], reserved_quantity: [4, 6, 3, 2][i], available_quantity: [8, 22, 0, 0][i] })),
    '/api/v1/products': products,
    '/api/v1/warehouses': [{ id: 1, code: 'MAIN', name: 'Main warehouse', status: 'active' }, { id: 2, code: 'SHOP', name: 'Retail floor', status: 'active' }],
  }
  fixtures['/api/v1/customers'][0] = { ...fixtures['/api/v1/customers'][0], email: 'sample@example.test', phone: '+60 12-555 0101' }
  fixtures['/api/v1/sales-orders/1'] = { ...fixtures['/api/v1/sales-orders'][0], items: [] }
  fixtures['/api/v1/categories'].forEach(category => {
    category.parent = fixtures['/api/v1/categories'].find(parent => parent.id === category.parent_id) ?? null
    category.products_count = products.filter(product => product.category_id === category.id).length
    category.children_count = fixtures['/api/v1/categories'].filter(child => child.parent_id === category.id).length
  })
  const writes = [], errors = []
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data)
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result); return }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params
      if (['POST', 'PUT'].includes(request.method)) writes.push({ path: new URL(request.url).pathname, payload: JSON.parse(request.postData || '{}') })
      const url = new URL(request.url)
      let responseData = fixtures[url.pathname] ?? []
      if (url.pathname === '/api/v1/products' && request.method === 'GET') {
        const category = url.searchParams.get('category_id'), status = url.searchParams.get('status')
        responseData = products.filter(product => (!status || product.status === status) && (!category || Number(category) === 10 ? !category || [10, 11, 12, 13].includes(product.category_id) : product.category_id === Number(category)))
      }
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5174' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'content-type,x-xsrf-token' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' }], body: Buffer.from(JSON.stringify({ data: responseData })).toString('base64') })
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: '*localhost:8000/*' }, { urlPattern: '*127.0.0.1:8000/*' }] })
  await send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile })
  await send('Page.navigate', { url: `http://localhost:5174/${page === 'dashboard' ? 'dashboard' : `modules/${page}`}` })
  await pause(2200)
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value
  const click = async label => { assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)return false;b.focus();b.click();return true})()`), true, `Missing button: ${label}`); await pause(250) }
  const change = async (selector, value) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`); await pause(200) }
  if (process.argv.includes('--check')) {
    const equalColumns = await evaluate(`(()=>{const table=document.querySelector('.data-table');if(!table)return true;const widths=[...table.querySelectorAll('thead th')].map(cell=>cell.getBoundingClientRect().width);return Math.max(...widths)-Math.min(...widths)<1})()`)
    assert.equal(equalColumns, true, 'Table column widths are not equal')
    const alignment = await evaluate(`(()=>{const table=document.querySelector('.data-table');if(!table)return [];const headers=[...table.querySelectorAll('thead th')];return [...table.querySelectorAll('tbody tr')].flatMap(row=>[...row.cells].flatMap((cell,i)=>{const h=getComputedStyle(headers[i]),c=getComputedStyle(cell);return h.textAlign!==c.textAlign||h.paddingLeft!==c.paddingLeft||h.paddingRight!==c.paddingRight?[{column:i,header:h.textAlign,cell:c.textAlign}]:[]}))})()`)
    assert.deepEqual(alignment, [], 'Shared table headings and cells have inconsistent alignment or padding')
    const centered = await evaluate(`(()=>{const failures=[];for(const cell of document.querySelectorAll('.data-table tbody .table-centered-cell,.data-table tbody .table-actions-cell')){const r=cell.getBoundingClientRect(),center=r.left+r.width/2;const badge=cell.querySelector('.ui-status');if(badge){const b=badge.getBoundingClientRect();if(Math.abs(b.left+b.width/2-center)>1)failures.push('Status badge is off-center')}const buttons=[...cell.querySelectorAll('button,a.ui-button')];if(buttons.length){const rects=buttons.map(b=>b.getBoundingClientRect()),groupCenter=(Math.min(...rects.map(r=>r.left))+Math.max(...rects.map(r=>r.right)))/2;if(Math.abs(groupCenter-center)>1)failures.push('Action buttons are off-center')}if(getComputedStyle(cell).textAlign!=='center')failures.push('Centered column is not centered')}return failures})()`)
    assert.deepEqual(centered, [], 'Status or action content is not centered within its column')
    const gutter = await evaluate(`(()=>{const header=document.querySelector('.workspace-heading'),panel=document.querySelector('.table-panel');return !header||!panel||Math.abs(header.getBoundingClientRect().left-panel.getBoundingClientRect().left)<1})()`)
    assert.equal(gutter, true, 'Page title and table use different workspace gutters')
    if (mobile) {
      await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`)
      assert.equal(await evaluate(`document.querySelector('.sidebar').classList.contains('sidebar-open')`), true)
      await evaluate(`document.querySelector('.sidebar-scrim').click()`)
    } else {
      await evaluate(`document.querySelector('[aria-label="Collapse navigation"]').click()`)
      assert.equal(await evaluate(`document.querySelector('.app-shell').classList.contains('nav-collapsed')`), true)
      await send('Page.reload'); await pause(1200)
      assert.equal(await evaluate(`document.querySelector('.app-shell').classList.contains('nav-collapsed')`), true)
      await evaluate(`document.querySelector('[aria-label="Expand navigation"]').click()`)
    }
    if (page === 'dashboard') {
      await click('Repairs2')
      assert.equal(await evaluate(`document.querySelectorAll('.operations-grid tbody tr').length`), 2)
      await click('All work5')
      await evaluate(`document.querySelector('.operations-grid tbody a').click()`); await pause(800)
      assert.equal(await evaluate(`Boolean([...document.querySelectorAll('h2')].find(h=>h.textContent==='SO-2026-00126'))`), true, 'Dashboard record link did not open the record')
      await send('Page.navigate', { url: 'http://localhost:5174/dashboard' }); await pause(1200)
    } else if (page === 'categories') {
      assert.equal(await evaluate(`Boolean(document.querySelector('nav a[href="/modules/categories"]'))`), true)
      await click(createAction)
      await change('dialog input', 'Graphics cards')
      await change('dialog select', '10')
      await click('Save record'); await pause(500)
      assert.deepEqual(writes.find(write => write.path.endsWith('/categories'))?.payload, { name: 'Graphics cards', parent_id: 10, status: 'active' })
      await click('Edit')
      assert.equal(await evaluate(`document.querySelector('dialog h2').textContent`), 'Edit category')
      assert.equal(await evaluate(`document.querySelector('dialog select').options.length`), 2, 'Parent selector permits a descendant')
      await click('Cancel')
      await click('Delete')
      assert.equal(await evaluate(`document.querySelector('dialog button[type="submit"]').disabled`), true, 'Occupied category can be deleted')
      await click('Cancel')
    } else if (page === 'sales-orders') {
      await click(createAction)
      const tops = await evaluate(`(()=>{const fields=[...document.querySelectorAll('dialog form > .order-form-grid:first-child select')];return fields.map(e=>e.getBoundingClientRect().top)})()`)
      if (!mobile) assert.ok(Math.abs(tops[0] - tops[1]) < 1, 'Customer and warehouse are misaligned')
      await change('dialog form > .order-form-grid:first-child label:nth-child(2) select', '1')
      await change('.sales-order-item > label:first-child select', '10')
      assert.equal(await evaluate(`document.querySelector('.product-picker select').options.length`), 4, 'Parent category did not include child-category products')
      await change('.sales-order-item > label:first-child select', '11')
      assert.equal(await evaluate(`document.querySelector('.product-picker select').options.length`), 2, 'Category did not narrow product options')
      await change('.product-picker select', '1')
      assert.ok((await evaluate(`document.querySelector('.order-form-footer strong').textContent`)).includes('1,699'))
      await change('.sales-order-item > label:first-child select', '20')
      assert.equal(await evaluate(`document.querySelector('.product-picker select').value`), '', 'Category change retained the previous product')
      await change('.product-picker select', '4')
      assert.equal(await evaluate(`Boolean(document.querySelector('.sales-order-item--serialized'))`), true)
      await change('.sales-order-item > label:nth-last-of-type(1) select', '1')
      await change('.sales-order-item > label:first-child select', '11')
      assert.equal(await evaluate(`Boolean(document.querySelector('.sales-order-item--serialized'))`), false, 'Old serial field was not cleared')
      await change('.product-picker select', '1')
      await click('Create order'); await pause(500)
      assert.deepEqual(writes.find(write=>write.path.endsWith('/sales-orders'))?.payload.items, [{ product_id: 1, quantity: 1, inventory_unit_id: null }])
      assert.equal(await evaluate(`Boolean(document.querySelector('dialog'))`), false, 'Successful sale creation did not close the modal')
    } else if (page === 'inventory') {
      await change('[aria-label="Filter availability"]', 'out_of_stock')
      assert.equal(await evaluate(`document.querySelectorAll('tbody tr').length`), 2)
      await click('Clear filters'); await click('Adjust stock')
      await change('select[required]', '1')
      // Select the warehouse explicitly; selects live inside separate labels.
      await evaluate(`(()=>{const e=document.querySelectorAll('select[required]')[1];e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await change('input[type="number"]', '5'); await change('textarea', 'Stock count')
      await click('Save adjustment'); await pause(600)
      assert.deepEqual(writes.find(write=>write.path.endsWith('stock-adjustments'))?.payload, { product_id: 1, warehouse_id: 1, quantity_delta: 5, reason: 'Stock count' })
      assert.equal(await evaluate(`document.querySelectorAll('.record-form-panel').length`), 0)
    } else if (page === 'products') {
      await change('[aria-label="Filter product status"]', 'inactive')
      assert.equal(await evaluate(`document.querySelectorAll('tbody tr').length`), 1)
      await click('Clear filters'); await click('New product')
      assert.equal(await evaluate(`document.querySelector('dialog input[readonly]')?.placeholder`), 'Auto-generated on save')
      await change('.record-form-panel input[type="text"]:not([readonly])', 'Review product')
      await change('.record-form-panel select[required]', 'physical')
      await evaluate(`(()=>{const e=document.querySelectorAll('.record-form-panel select[required]')[1];e.value='quantity';e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await click('Create product'); await pause(600)
      const write = writes.find(write=>write.path.endsWith('/products'))
      assert.equal(Object.hasOwn(write?.payload ?? {}, 'sku'), false); assert.equal(write?.payload.name, 'Review product')
      assert.equal(write?.payload.tracking_type, 'quantity')
      assert.equal(await evaluate(`document.querySelectorAll('.record-form-panel').length`), 0)
    }
    console.log('Browser interaction checks passed')
  }
  if (process.argv.includes('--form')) await click(createAction)
  if (process.argv.includes('--modal-check')) {
    assert.equal(await evaluate(`Boolean(document.querySelector('dialog:modal'))`), true, 'Form is not a native modal')
    assert.equal(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true, 'Initial focus is outside the modal')
    assert.equal(await evaluate(`document.body.style.overflow`), 'hidden', 'Workspace scrolling is not locked')
    const bounds = await evaluate(`(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()`)
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height, 'Modal does not fit the viewport')
    for (let i = 0; i < 24; i++) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      // Native dialog permits the browser chrome during a wrap but never the workspace.
      assert.equal(await evaluate(`document.activeElement===document.body || document.querySelector('dialog').contains(document.activeElement)`), true, 'Tab escaped to the workspace')
    }
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await pause(250)
    assert.equal(await evaluate(`Boolean(document.querySelector('dialog'))`), false, 'Escape did not dismiss the modal')
    assert.equal(await evaluate(`document.activeElement.textContent.trim()`), createAction, 'Trigger focus was not restored')
    assert.equal(await evaluate(`document.body.style.overflow`), '', 'Scroll locking leaked after closing')
    await click(createAction)
    if (page === 'products' && process.argv.includes('--check')) {
      await click('Cancel')
      await evaluate(`document.querySelector('tbody button').click()`); await pause(300)
      assert.equal(await evaluate(`document.querySelector('dialog h2').textContent`), 'Edit product')
      const originalSku = await evaluate(`document.querySelector('dialog input[readonly]').value`)
      assert.equal(originalSku, 'CPU-AMD-7800')
      await change('dialog input[type="text"]:not([readonly])', 'Updated review product')
      await click('Save changes'); await pause(500)
      const update = writes.find(write=>write.path.endsWith('/products/1'))?.payload
      assert.equal(Object.hasOwn(update ?? {}, 'sku'), false)
      assert.equal(update?.name, 'Updated review product')
      assert.equal(await evaluate(`Boolean(document.querySelector('dialog'))`), false, 'Successful edit did not close the modal')
      await click('New product')
    }
    console.log('Native modal, keyboard focus, Escape, scroll lock, and viewport checks passed')
  }
  const metrics = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({ title:document.querySelector('h1')?.textContent, width:innerWidth, documentWidth:document.documentElement.scrollWidth, headingSize:document.querySelector('h1') && getComputedStyle(document.querySelector('h1')).fontSize, rows:document.querySelectorAll('tbody tr').length, overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>${mobile ? 390 : 1440} && !e.closest('.table-scroll')).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right})).slice(0,12) })` })
  console.log(metrics.result.value)
  assert.ok(JSON.parse(metrics.result.value).documentWidth <= (mobile ? 390 : 1440), 'The page overflows its viewport')
  assert.equal(errors.length, 0, `Browser exceptions: ${errors.join(', ')}`)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const output = join(tmpdir(), 'techops-visual-review')
  await mkdir(output, { recursive: true })
  const path = join(output, `${page}-${mobile ? 'mobile' : 'desktop'}${process.argv.includes('--form') ? '-form' : ''}.png`)
  await writeFile(path, Buffer.from(shot.data, 'base64'))
  console.log(path)
} finally { socket?.close(); chrome.kill(); await pause(300); await rm(profile, { recursive: true, force: true }).catch(() => {}) }
