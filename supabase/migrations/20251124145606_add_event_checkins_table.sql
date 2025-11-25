/*
  # Add event_checkins table

  1. New Tables
    - `event_checkins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `event_id` (uuid, foreign key to events)
      - `latitude` (double precision, nullable)
      - `longitude` (double precision, nullable)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `event_checkins` table
    - Add policy for authenticated users to check-in to events
    - Add policy for users to view their own check-ins
*/

CREATE TABLE IF NOT EXISTS event_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can check-in to events"
  ON event_checkins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own check-ins"
  ON event_checkins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all check-ins"
  ON event_checkins FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_event_checkins_event_id ON event_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_event_checkins_user_id ON event_checkins(user_id);