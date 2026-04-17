-- Migration: Auto-assign new users to default org
-- Run this in Supabase SQL Editor

-- 1. Add is_default column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 2. Mark current org as default (update slug if different)
UPDATE public.organizations SET is_default = true WHERE slug = 'nepean-wildcats';

-- 3. Replace trigger to auto-assign new users to default org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_org_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');

  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE is_default = true
  LIMIT 1;

  IF default_org_id IS NOT NULL THEN
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (default_org_id, new.id, 'pending');

    UPDATE public.profiles
    SET active_org_id = default_org_id
    WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
