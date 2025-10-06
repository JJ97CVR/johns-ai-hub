-- Drop existing policies and function that depend on the enum
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
DROP FUNCTION IF EXISTS has_role(uuid, app_role);

-- Rename and create new enum
ALTER TYPE app_role RENAME TO app_role_old;
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'user');

-- Update the user_roles table
ALTER TABLE user_roles 
  ALTER COLUMN role TYPE app_role USING role::text::app_role;

-- Drop old enum
DROP TYPE app_role_old CASCADE;

-- Recreate the has_role function with new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Recreate RLS policies
CREATE POLICY "Admins can view all roles" 
ON user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can insert roles" 
ON user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update roles" 
ON user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can delete roles" 
ON user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Insert owner role for your user
INSERT INTO user_roles (user_id, role) 
VALUES ('fe673673-c61f-4d2f-ac83-2ea49dd1e6cf', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;

COMMENT ON TYPE app_role IS 'Application roles: owner (highest privileges), admin (management), user (standard access)';
COMMENT ON TABLE user_roles IS 'User role assignments - owner has full control, admin can manage, user has standard access';