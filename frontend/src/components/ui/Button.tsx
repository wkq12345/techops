import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'default' | 'small' | 'icon'
interface Appearance { variant?: Variant; size?: Size; className?: string; children?: ReactNode }
function classes({ variant = 'secondary', size = 'default', className = '' }: Appearance) {
  return `ui-button ui-button--${variant} ui-button--${size} ${className}`
}
export function Button({ variant, size, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Appearance) {
  return <button type={type} className={classes({ variant, size, className })} {...props} />
}
export function ButtonLink({ variant, size, className, ...props }: LinkProps & Appearance) {
  return <Link className={classes({ variant, size, className })} {...props} />
}
