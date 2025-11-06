-- PostgreSQL migration for pending_registrations table
-- Run this in your Neon database console

-- Create pending_registrations table
CREATE TABLE IF NOT EXISTS pending_registrations (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  address TEXT,
  ethnicity VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  birth_certificate_data TEXT, -- Base64 encoded file data
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_comment TEXT, -- Admin comment when rejecting
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status ON pending_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_submitted_at ON pending_registrations(submitted_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_pending_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pending_registrations_updated_at
  BEFORE UPDATE ON pending_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_registrations_updated_at();
