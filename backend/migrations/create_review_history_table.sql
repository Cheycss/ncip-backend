-- Create review_history table for tracking admin review actions
CREATE TABLE IF NOT EXISTS review_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    document_id INT NULL,
    action VARCHAR(50) NOT NULL, -- 'document_review', 'application_review', 'status_change'
    status VARCHAR(50) NOT NULL, -- 'approved', 'rejected', 'pending', etc.
    notes TEXT NULL,
    reviewed_by INT NOT NULL,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_application_id (application_id),
    INDEX idx_document_id (document_id),
    INDEX idx_reviewed_by (reviewed_by),
    INDEX idx_reviewed_at (reviewed_at),
    
    -- Foreign key constraints
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES uploaded_documents(id) ON DELETE CASCADE
);

-- Add review fields to applications table (ignore errors if columns already exist)
-- Note: Run these one by one, ignore errors if columns already exist

-- Add reviewed_by column
-- ALTER TABLE applications ADD COLUMN reviewed_by INT NULL;

-- Add reviewed_at column  
-- ALTER TABLE applications ADD COLUMN reviewed_at TIMESTAMP NULL;

-- Add review_notes column
-- ALTER TABLE applications ADD COLUMN review_notes TEXT NULL;

-- Add index for reviewed_by
-- ALTER TABLE applications ADD INDEX idx_reviewed_by (reviewed_by);

-- Add foreign key constraint
-- ALTER TABLE applications ADD FOREIGN KEY fk_applications_reviewed_by (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL;
