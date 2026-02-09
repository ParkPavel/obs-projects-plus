/**
 * Типы для валидации и обработки ошибок ввода
 */

/**
 * Тип для ошибки поля ввода
 * Используется для сообщений об ошибках конкретного поля
 */
export type FieldError = string | null;

/**
 * Тип для структурированной ошибки валидации
 * Используется для более сложных сценариев валидации
 */
export type ValidationError = {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
};

/**
 * Тип для массива ошибок валидации
 * Используется для хранения нескольких ошибок валидации
 */
export type ValidationErrors = ValidationError[];

/**
 * Тип для функции валидации
 * Принимает значение и возвращает ошибку или null
 */
export type Validator<T = any> = (value: T) => FieldError;

/**
 * Хелперы для валидации
 */

/**
 * Создает валидатор поля
 * @param validator - Функция валидации
 * @returns Функция валидации
 */
export function createFieldValidator<T>(
  validator: (value: T) => FieldError
): Validator<T> {
  return validator;
}

/**
 * Валидация обязательного поля
 * @param value - Значение для проверки
 * @returns Ошибка или null
 */
// /skip @typescript-eslint/no-explicit-any - Generic validator accepting any input type
export function validateRequired(value: any): FieldError {
  return !value || value.toString().trim() === ""
    ? "This field is required"
    : null;
}

/**
 * Валидация имени
 * @param name - Имя для проверки
 * @returns Ошибка или null
 */
export function validateName(name: string): FieldError {
  if (!name.trim()) return "Name cannot be empty";
  if (name.length < 2) return "Name too short";
  return null;
}

/**
 * Валидация email
 * @param email - Email для проверки
 * @returns Ошибка или null
 */
export function validateEmail(email: string): FieldError {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return "Email is required";
  if (!emailRegex.test(email)) return "Invalid email format";
  return null;
}