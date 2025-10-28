// Unique ID Generator Utility
// Generates unique IDs for users, applications, and other entities

/**
 * Generate a unique user ID
 * Format: USR-YYYYMMDD-XXXXXX (e.g., USR-20251022-123456)
 */
export const generateUserId = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `USR-${dateStr}-${randomNum}`;
};

/**
 * Generate a unique application ID
 * Format: APP-YYYYMMDD-XXXXXX (e.g., APP-20251022-123456)
 */
export const generateApplicationId = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `APP-${dateStr}-${randomNum}`;
};

/**
 * Generate a unique admin ID
 * Format: ADM-YYYYMMDD-XXXXXX (e.g., ADM-20251022-123456)
 */
export const generateAdminId = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `ADM-${dateStr}-${randomNum}`;
};

/**
 * Generate a unique document ID
 * Format: DOC-YYYYMMDD-XXXXXX (e.g., DOC-20251022-123456)
 */
export const generateDocumentId = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `DOC-${dateStr}-${randomNum}`;
};

/**
 * Generate a unique certificate number
 * Format: CERT-YYYYMMDD-XXXXXX (e.g., CERT-20251022-123456)
 */
export const generateCertificateNumber = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `CERT-${dateStr}-${randomNum}`;
};

/**
 * Generate a unique application number (for display)
 * Format: NCIP-YYYY-XXXXXX (e.g., NCIP-2025-123456)
 */
export const generateApplicationNumber = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `NCIP-${year}-${randomNum}`;
};

export default {
  generateUserId,
  generateApplicationId,
  generateAdminId,
  generateDocumentId,
  generateCertificateNumber,
  generateApplicationNumber
};
