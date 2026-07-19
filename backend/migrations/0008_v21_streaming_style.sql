-- Migration to version 21
-- Adds ethereal_streaming_style to profiles table

ALTER TABLE profiles ADD COLUMN ethereal_streaming_style TEXT DEFAULT 'buffered';
