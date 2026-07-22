-- Add bank_transaction_id column for deduplication of GoCardless/n8n transactions
ALTER TABLE jarvis_transactions 
ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT UNIQUE;
