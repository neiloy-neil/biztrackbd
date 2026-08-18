-- Migration to introduce platform_settings table

CREATE TABLE platform_settings (
    key VARCHAR PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view settings" ON platform_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
    );

CREATE POLICY "Super Admins can modify settings" ON platform_settings
    FOR ALL USING (
        public.has_platform_permission('platform.settings.manage')
    );

-- Insert defaults
INSERT INTO platform_settings (key, value) VALUES 
('general', '{ "platformName": "BizTrack BD", "supportEmail": "support@biztrackbd.com", "supportPhone": "+8801700000000", "defaultCurrency": "BDT", "defaultTimezone": "Asia/Dhaka" }'::jsonb),
('billing', '{ "defaultTrialDuration": 14, "renewalGracePeriod": 3 }'::jsonb),
('security', '{ "adminSessionDuration": 24, "businessSessionDuration": 168, "mfaEnforced": false }'::jsonb),
('auth_limits', '{ "otpExpiryMinutes": 3, "maxOtpAttempts": 5 }'::jsonb);
