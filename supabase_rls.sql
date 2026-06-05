-- פתח גישת קריאה לכולם (anon) וכתיבה לבינתיים לפיתוח
ALTER TABLE users      DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipes    DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE steps      DISABLE ROW LEVEL SECURITY;
ALTER TABLE communities DISABLE ROW LEVEL SECURITY;
ALTER TABLE likes      DISABLE ROW LEVEL SECURITY;

GRANT ALL ON users, recipes, ingredients, steps, communities, likes TO anon, authenticated;
