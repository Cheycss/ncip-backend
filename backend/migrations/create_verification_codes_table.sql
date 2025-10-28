-- Create verification_codes table for email verification
CREATE TABLE IF NOT EXISTS verification_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type ENUM('login', 'registration', 'admin_create') DEFAULT 'login' NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for better performance
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_type (type),
  INDEX idx_expires_at (expires_at),
  INDEX idx_email_code_type (email, code, type)
);

-- Optional: Create a cleanup procedure for expired codes
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_verification_codes
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  DELETE FROM verification_codes 
  WHERE expires_at < NOW() OR used = TRUE;
END //
DELIMITER ;
