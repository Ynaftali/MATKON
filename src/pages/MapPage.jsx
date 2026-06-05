import { useNavigate } from 'react-router-dom'
import { IconSearch, IconChevronLeft } from '@tabler/icons-react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { mockCommunities } from '../lib/mock'
import BottomNav from '../components/BottomNav'

const MAX_MEMBERS = Math.max(...mockCommunities.map(c => c.member_count))

export default function MapPage() {
  const navigate = useNavigate()

  return (
    <div className="map-page">
      <div className="topbar">
        <div className="topbar-side" />
        <span className="topbar-title">IsraelKitchen</span>
        <div className="topbar-side" />
      </div>

      <div className="map-hero-title">אנחנו על המפה ואנחנו נבשל על המפה</div>
      <div className="map-hero-sub">ישראלים מבשלים בכל העולם</div>

      <div className="map-search">
        <div className="search-bar">
          <IconSearch size={18} />
          <input placeholder="חפשו מדינה או מתכון..." />
        </div>
      </div>

      <div className="map-container-wrapper">
        <MapContainer
          center={[20, 10]}
          zoom={2}
          style={{ width: '100%', height: 240, borderRadius: 16 }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {mockCommunities.map(c => (
            <CircleMarker
              key={c.id}
              center={[c.lat, c.lng]}
              radius={c.is_mine ? 10 : Math.max(4, Math.round((c.member_count / MAX_MEMBERS) * 14))}
              pathOptions={{
                color:       c.is_mine ? '#5ecb8a' : '#3d6fa8',
                fillColor:   c.is_mine ? '#5ecb8a' : '#3d6fa8',
                fillOpacity: 0.8,
                weight: c.is_mine ? 3 : 1,
              }}
            >
              <Popup>
                <div style={{ direction:'rtl', fontFamily:'Heebo,sans-serif', fontSize:13 }}>
                  <strong>{c.country_flag} {c.country_name}</strong><br />
                  {c.member_count.toLocaleString()} חברים
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="map-stats-row">
        <div className="map-stat">
          <div className="map-stat-val">{mockCommunities.length}</div>
          <div className="map-stat-lbl">מדינות</div>
        </div>
        <div className="map-stat">
          <div className="map-stat-val">{mockCommunities.reduce((a,c)=>a+c.member_count,0).toLocaleString()}</div>
          <div className="map-stat-lbl">חברים</div>
        </div>
        <div className="map-stat">
          <div className="map-stat-val">{mockCommunities.reduce((a,c)=>a+c.recipes_count,0)}</div>
          <div className="map-stat-lbl">מתכונים</div>
        </div>
      </div>

      <div className="map-communities">
        <div className="section-title" style={{ marginBottom: 8 }}>קהילות לפי גודל</div>
        {mockCommunities.map(c => (
          <div key={c.id} className="community-row" onClick={() => navigate(`/community/${c.country_code}`)}>
            <span className="community-flag">{c.country_flag}</span>
            <div className="community-info">
              <div className="community-name">
                {c.country_name}
                {c.is_mine && <span className="community-mine-tag" style={{ marginRight: 8 }}>אתם כאן</span>}
              </div>
              <div className="community-count">{c.member_count.toLocaleString()} חברים · {c.recipes_count} מתכונים</div>
              <div className="community-bar-wrap" style={{ marginTop: 4 }}>
                <div className="community-bar" style={{ width: `${(c.member_count / MAX_MEMBERS) * 100}%` }} />
              </div>
            </div>
            <IconChevronLeft size={16} className="community-chevron" />
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
