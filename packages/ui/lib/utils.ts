/**
 * Utility function for merging Tailwind CSS classes
 * 
 * @source Standard pattern from shadcn/ui
 * @license MIT
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
