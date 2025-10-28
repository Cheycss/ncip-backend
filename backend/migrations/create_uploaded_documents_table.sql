-- Create uploaded_documents table for tracking file uploads
CREATE TABLE IF NOT EXISTS uploaded_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    user_id INT NULL,
    document_type VARCHAR(100) NOT NULL, -- 'coc_page_1', 'coc_page_2', 'birth_certificate', etc.
    requirement_id VARCHAR(100) NULL, -- Links to purpose requirements
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    upload_status ENUM('uploaded', 'processing', 'failed') DEFAULT 'uploaded',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Review fields (for admin review process)
    review_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_application_id (application_id),
    INDEX idx_user_id (user_id),
    INDEX idx_document_type (document_type),
    INDEX idx_upload_status (upload_status),
    INDEX idx_review_status (review_status),
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Add some sample document types for reference
INSERT IGNORE INTO uploaded_documents (id, application_id, document_type, original_name, filename, file_path, file_size, mime_type) VALUES
(1, 'SAMPLE', 'coc_page_1', 'COC_Page_1_Sample.pdf', 'sample_coc_1.pdf', '/uploads/sample/sample_coc_1.pdf', 1024, 'application/pdf'),
(2, 'SAMPLE', 'birth_certificate', 'Birth_Certificate_Sample.jpg', 'sample_birth_cert.jpg', '/uploads/sample/sample_birth_cert.jpg', 2048, 'image/jpeg');

-- Create uploads directory structure reference
-- /uploads/
--   /{application_id}/
--     /coc_pages/
--       - coc_page_1_{timestamp}_{original_name}
--       - coc_page_2_{timestamp}_{original_name}
--       - coc_page_3_{timestamp}_{original_name}
--       - coc_page_4_{timestamp}_{original_name}
--       - coc_page_5_{timestamp}_{original_name}
--     /requirements/
--       - birth_certificate_{timestamp}_{original_name}
--       - school_id_{timestamp}_{original_name}
--       - etc...
