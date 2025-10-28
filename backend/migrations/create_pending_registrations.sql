-- Create pending_registrations table for storing registration submissions before admin approval
CREATE TABLE IF NOT EXISTS pending_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  address TEXT,
  ethnicity VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  birth_certificate_data LONGTEXT, -- Base64 encoded file data
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_comment TEXT, -- Admin comment when rejecting
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submitted_at)
);

-- Add some sample data for testing (optional)
-- INSERT INTO pending_registrations (
--   first_name, last_name, display_name, email, phone_number, 
--   address, ethnicity, password_hash, status
-- ) VALUES (
--   'John', 'Doe', 'John D.', 'john.doe@example.com', '+639123456789',
--   'Sample Address, Alabel, Sarangani', 'Blaan', 
--   '$2b$12$sample.hash.for.testing', 'pending'
-- );
