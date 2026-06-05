import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txstregguvnuyyxensun.supabase.co',
  'sb_publishable_FhmhmkgMlljKWvCK1uTo4Q_tI6IeIsf'
)

// 1. Insert users
const { data: users, error: usersError } = await supabase
  .from('users')
  .insert([
    { full_name: 'מיכל כהן', country: 'גרמניה', city: 'ברלין', bio: 'מבשלת ישראלית בברלין' },
    { full_name: 'יוני לוי',  country: 'ארה"ב',  city: 'ניו יורק', bio: 'שף חובב בניו יורק' },
    { full_name: 'דנה מזרחי', country: 'צרפת',   city: 'פריז',    bio: 'אוהבת בישול ים תיכוני' },
  ])
  .select()

if (usersError) { console.error('users error:', usersError.message); process.exit(1) }
console.log('✅ users inserted:', users.map(u => u.full_name).join(', '))

// 2. Insert recipes
const { data: recipes, error: recipesError } = await supabase
  .from('recipes')
  .insert([
    {
      user_id: users[0].id,
      title: 'חומוס ביתי',
      description: 'חומוס קרמי ועשיר כמו של אמא — מושלם לארוחת ערב ישראלית בלב ברלין.',
      category: 'ממרחים',
      country_origin: 'ישראל',
      prep_time: 20,
      cook_time: 40,
      servings: 6,
      is_public: true,
    },
    {
      user_id: users[1].id,
      title: 'שקשוקה קלאסית',
      description: 'ביצים ברוטב עגבניות ופלפלים — ארוחת בוקר ישראלית שכובשת את ניו יורק.',
      category: 'ארוחת בוקר',
      country_origin: 'ישראל',
      prep_time: 10,
      cook_time: 20,
      servings: 2,
      is_public: true,
    },
    {
      user_id: users[2].id,
      title: 'סלט ישראלי',
      description: 'עגבניות, מלפפון, בצל וגרגיר הנחלים — פריז לא ידעה סלט כזה.',
      category: 'סלטים',
      country_origin: 'ישראל',
      prep_time: 15,
      cook_time: 0,
      servings: 4,
      is_public: true,
    },
  ])
  .select()

if (recipesError) { console.error('recipes error:', recipesError.message); process.exit(1) }
console.log('✅ recipes inserted:', recipes.map(r => r.title).join(', '))
console.log('\nFeed אמור להציג 3 מתכונים עכשיו 🎉')
