import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Объединяет классы CSS с использованием clsx и tailwind-merge
 * @param {...any} inputs - Классы для объединения
 * @returns {string} Объединенная строка классов
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

/**
 * Проверяет, выполняется ли приложение в iframe
 * @constant {boolean}
 */
export const isIframe = window.self !== window.top;
