-- Create request_templates table
CREATE TABLE public.request_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system_template BOOLEAN NOT NULL DEFAULT false,
  category TEXT,
  
  -- Template data fields (same as video_requests)
  title TEXT,
  caption TEXT,
  story_idea TEXT,
  company_type company_type,
  client_company_name TEXT,
  city_community TEXT,
  character TEXT,
  visual_style visual_style,
  colors TEXT,
  gender_avatar gender_avatar,
  scenes INTEGER,
  aspect_ratio aspect_ratio,
  render_mode render_mode_v2,
  special_request TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_templates ENABLE ROW LEVEL SECURITY;

-- System templates readable by all authenticated users
CREATE POLICY "System templates are viewable by all authenticated users"
ON public.request_templates
FOR SELECT
USING (is_system_template = true AND auth.uid() IS NOT NULL);

-- Users can view their own custom templates
CREATE POLICY "Users can view their own templates"
ON public.request_templates
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own templates
CREATE POLICY "Users can create their own templates"
ON public.request_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_system_template = false);

-- Users can update their own templates
CREATE POLICY "Users can update their own templates"
ON public.request_templates
FOR UPDATE
USING (auth.uid() = user_id AND is_system_template = false);

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
ON public.request_templates
FOR DELETE
USING (auth.uid() = user_id AND is_system_template = false);

-- Admins can manage all templates
CREATE POLICY "Admins can manage all templates"
ON public.request_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add updated_at trigger
CREATE TRIGGER update_request_templates_updated_at
BEFORE UPDATE ON public.request_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed pre-built system templates
INSERT INTO public.request_templates (
  user_id, name, description, is_system_template, category,
  title, caption, story_idea, company_type, character, visual_style, colors,
  gender_avatar, scenes, aspect_ratio, render_mode
) VALUES
(
  NULL, 'Roofing Summer Promo', 'Summer roofing special campaign', true, 'seasonal',
  'Summer Roofing Special', 'Protect your home this summer with quality roofing services!',
  'Showcase a professional roofing team installing high-quality shingles on a sunny summer day. Highlight durability, professionalism, and peace of mind.',
  'roofing', 'Professional roofing contractor', 'realistic', 'Blue and gray',
  'neutral', 5, '16:9', 'veo3_fast'
),
(
  NULL, 'Gutter Cleaning Fall Campaign', 'Fall gutter protection service', true, 'seasonal',
  'Fall Gutter Protection', 'Prepare for fall weather with professional gutter cleaning!',
  'Show leaves falling and clogging gutters, then transition to a professional team cleaning them efficiently. Emphasize protection and preparation.',
  'gutter', 'Experienced gutter specialist', 'realistic', 'Orange and brown autumn tones',
  'neutral', 4, '9:16', 'veo3_fast'
),
(
  NULL, 'Holiday Lights Installation', 'Holiday lighting service campaign', true, 'seasonal',
  'Holiday Lighting Magic', 'Make your home shine this holiday season with professional installation!',
  'Create a magical scene of a home being transformed with beautiful holiday lights. Show before and after, emphasizing the wow factor.',
  'christmas_lights', 'Friendly holiday lighting expert', 'cartoonized', 'Red, green, and gold',
  'neutral', 6, '9:16', 'veo3'
),
(
  NULL, 'Landscaping Spring Renewal', 'Spring landscaping transformation', true, 'seasonal',
  'Spring Landscaping Transformation', 'Transform your outdoor space this spring with expert landscaping!',
  'Show the transition from winter dormancy to spring renewal. Feature planting, mulching, and creating vibrant outdoor spaces.',
  'landscaping', 'Professional landscaper', 'realistic', 'Green and earth tones',
  'neutral', 5, '16:9', 'veo3_fast'
),
(
  NULL, 'Power Washing Service', 'Pressure washing excellence campaign', true, 'service',
  'Pressure Washing Excellence', 'Restore your property''s curb appeal with professional power washing!',
  'Dramatic before and after shots of dirty surfaces being transformed to pristine condition. Show driveways, siding, and decks.',
  'power_washing', 'Expert pressure washing technician', 'realistic', 'Blue and white',
  'neutral', 4, '16:9', 'veo3_fast'
);