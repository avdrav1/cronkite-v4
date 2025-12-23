-- Backfill folder_name for existing feeds from recommended_feeds
-- This updates feeds that were subscribed before folder_name was being copied

-- Update feeds that have a matching recommended_feed by URL
UPDATE feeds f
SET folder_name = rf.category
FROM recommended_feeds rf
WHERE f.url = rf.url
  AND f.folder_name IS NULL;

-- For feeds that don't match any recommended_feed, try to infer category from URL patterns
-- Technology feeds
UPDATE feeds
SET folder_name = 'Technology'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%techcrunch%' OR url ILIKE '%wired%' OR url ILIKE '%arstechnica%' OR
    url ILIKE '%theverge%' OR url ILIKE '%engadget%' OR url ILIKE '%zdnet%' OR
    url ILIKE '%9to5mac%' OR url ILIKE '%macrumors%' OR url ILIKE '%osxdaily%' OR
    url ILIKE '%hackaday%' OR url ILIKE '%xkcd%' OR
    name ILIKE '%tech%' OR name ILIKE '%gadget%' OR name ILIKE '%software%'
  );

-- Business & Finance feeds
UPDATE feeds
SET folder_name = 'Business'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%bloomberg%' OR url ILIKE '%wsj%' OR url ILIKE '%forbes%' OR
    url ILIKE '%reuters%' OR url ILIKE '%cnbc%' OR url ILIKE '%economist%' OR
    url ILIKE '%financial%' OR
    name ILIKE '%business%' OR name ILIKE '%finance%' OR name ILIKE '%market%'
  );

-- Science feeds
UPDATE feeds
SET folder_name = 'Science'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%nature%' OR url ILIKE '%science%' OR url ILIKE '%newscientist%' OR
    url ILIKE '%phys.org%' OR url ILIKE '%sciencedaily%' OR url ILIKE '%ancient%' OR
    name ILIKE '%science%' OR name ILIKE '%research%'
  );

-- World News feeds
UPDATE feeds
SET folder_name = 'World News'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%bbc%' OR url ILIKE '%cnn%' OR url ILIKE '%nytimes%' OR
    url ILIKE '%guardian%' OR url ILIKE '%washingtonpost%' OR url ILIKE '%apnews%' OR
    name ILIKE '%news%' OR name ILIKE '%world%' OR name ILIKE '%global%'
  );

-- Sports feeds
UPDATE feeds
SET folder_name = 'Sports'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%espn%' OR url ILIKE '%sports%' OR url ILIKE '%athletic%' OR
    url ILIKE '%atp%' OR url ILIKE '%topgear%' OR url ILIKE '%jalopnik%' OR
    url ILIKE '%caranddriver%' OR
    name ILIKE '%sport%' OR name ILIKE '%football%' OR name ILIKE '%basketball%' OR
    name ILIKE '%atp%' OR name ILIKE '%gear%' OR name ILIKE '%car%'
  );

-- Entertainment feeds
UPDATE feeds
SET folder_name = 'Entertainment'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%variety%' OR url ILIKE '%hollywood%' OR url ILIKE '%entertainment%' OR
    url ILIKE '%theonion%' OR url ILIKE '%vogue%' OR url ILIKE '%grazia%' OR
    url ILIKE '%harpersbazaar%' OR url ILIKE '%bonappetit%' OR
    name ILIKE '%movie%' OR name ILIKE '%entertainment%' OR name ILIKE '%celebrity%' OR
    name ILIKE '%onion%' OR name ILIKE '%vogue%' OR name ILIKE '%fashion%'
  );

-- Health feeds
UPDATE feeds
SET folder_name = 'Health'
WHERE folder_name IS NULL
  AND (
    url ILIKE '%health%' OR url ILIKE '%medical%' OR url ILIKE '%webmd%' OR
    name ILIKE '%health%' OR name ILIKE '%medical%' OR name ILIKE '%wellness%'
  );

-- Set remaining feeds to 'General'
UPDATE feeds
SET folder_name = 'General'
WHERE folder_name IS NULL;

-- Add comment
COMMENT ON TABLE feeds IS 'User feed subscriptions with folder_name for category grouping';
