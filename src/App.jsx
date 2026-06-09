import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash          from './pages/Splash'
import Peek            from './pages/Peek'
import Register        from './pages/Register'
import Login           from './pages/Login'
import SSOCountry      from './pages/SSOCountry'
import CompleteProfile from './pages/CompleteProfile'
import Feed            from './pages/Feed'
import RecipePage      from './pages/RecipePage'
import CookingMode     from './pages/CookingMode'
import AddRecipe       from './pages/AddRecipe'
import Profile         from './pages/Profile'
import MapPage         from './pages/MapPage'
import Community       from './pages/Community'
import Recipes         from './pages/Recipes'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                 element={<Splash />}          />
        <Route path="/peek"             element={<Peek />}            />
        <Route path="/register"         element={<Register />}        />
        <Route path="/login"            element={<Login />}           />
        <Route path="/sso"              element={<SSOCountry />}      />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/feed"             element={<Feed />}            />
        <Route path="/recipe/:id"       element={<RecipePage />}      />
        <Route path="/cook/:id"         element={<CookingMode />}     />
        <Route path="/add"              element={<AddRecipe />}        />
        <Route path="/profile"          element={<Profile />}         />
        <Route path="/map"              element={<MapPage />}         />
        <Route path="/community/:country" element={<Community />}    />
        <Route path="/recipes"            element={<Recipes />}       />
        <Route path="*"                 element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
