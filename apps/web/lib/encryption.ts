import crypto from 'crypto';

/**
 * 고객 데이터 암호화/복호화 유틸리티
 * AES-256-GCM 알고리즘 사용
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * 암호화 키 생성
 * 환경변수 ENCRYPTION_KEY를 기반으로 안전한 키 생성
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // 32 bytes (256 bits) 키 생성
  return crypto.scryptSync(key, 'salt', 32);
}

/**
 * 데이터 암호화
 * @param text - 암호화할 평문
 * @returns 암호화된 데이터 (iv:authTag:encrypted 형식)
 */
export function encrypt(text: string): string {
  if (!text) return '';

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // iv:authTag:encrypted 형식으로 반환
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 데이터 복호화
 * @param encryptedData - 암호화된 데이터 (iv:authTag:encrypted 형식)
 * @returns 복호화된 평문
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * 객체의 특정 필드들을 암호화
 * @param obj - 원본 객체
 * @param fields - 암호화할 필드명 배열
 * @returns 암호화된 객체
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const encrypted = { ...obj };

  fields.forEach((field) => {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encrypt(encrypted[field] as string) as T[keyof T];
    }
  });

  return encrypted;
}

/**
 * 객체의 특정 필드들을 복호화
 * @param obj - 암호화된 객체
 * @param fields - 복호화할 필드명 배열
 * @returns 복호화된 객체
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const decrypted = { ...obj };

  fields.forEach((field) => {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        decrypted[field] = decrypt(decrypted[field] as string) as T[keyof T];
      } catch (error) {
        console.error(`Failed to decrypt field ${String(field)}:`, error);
        // 복호화 실패 시 원본 유지 (마이그레이션 중일 수 있음)
      }
    }
  });

  return decrypted;
}

/**
 * 배열의 각 객체에서 특정 필드들을 복호화
 * @param arr - 암호화된 객체 배열
 * @param fields - 복호화할 필드명 배열
 * @returns 복호화된 객체 배열
 */
export function decryptArrayFields<T extends Record<string, any>>(
  arr: T[],
  fields: (keyof T)[]
): T[] {
  return arr.map((item) => decryptFields(item, fields));
}

/**
 * 이메일 마스킹 (부분 표시)
 * 예: user@example.com -> u***@example.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;

  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  const visibleChars = Math.min(2, Math.floor(localPart.length / 3));
  const masked = localPart.substring(0, visibleChars) + '***';

  return `${masked}@${domain}`;
}

/**
 * 이름 마스킹 (부분 표시)
 * 예: 홍길동 -> 홍*동
 */
export function maskName(name: string): string {
  if (!name || name.length <= 1) return name;

  if (name.length === 2) {
    return `${name[0]}*`;
  }

  const firstChar = name[0];
  const lastChar = name[name.length - 1];
  const masked = '*'.repeat(name.length - 2);

  return `${firstChar}${masked}${lastChar}`;
}

/**
 * 전화번호 마스킹
 * 예: 010-1234-5678 -> 010-****-5678
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;

  const cleaned = phone.replace(/[^0-9]/g, '');

  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)}-****-${cleaned.substring(7)}`;
  } else if (cleaned.length === 10) {
    return `${cleaned.substring(0, 3)}-***-${cleaned.substring(6)}`;
  }

  return phone;
}
