import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getProfile, getUserProfile, updateProfile, changePassword, deleteAccount, type User } from '../api/auth'

export default function ProfilePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

  const isStaff = currentUser?.user_type === 'staff'
  const targetUserId = searchParams.get('userId')
  const isViewingOther = isStaff && targetUserId && targetUserId !== currentUser?.id

  useEffect(() => {
    if (isViewingOther) {
      setViewingUserId(targetUserId)
      loadUserProfile(targetUserId)
    } else {
      loadOwnProfile()
    }
  }, [isViewingOther, targetUserId])

  async function loadOwnProfile() {
    try {
      const data = await getProfile()
      setProfile(data)
      setFirstName(data.first_name)
      setLastName(data.last_name)
      setEmail(data.email)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadUserProfile(userId: string) {
    try {
      const data = await getUserProfile(userId)
      setProfile(data)
      setFirstName(data.first_name)
      setLastName(data.last_name)
      setEmail(data.email)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await updateProfile({ first_name: firstName, last_name: lastName, email })
      setProfile(data)
      setEditing(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg('')
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match')
      return
    }
    try {
      const res = await changePassword(oldPassword, newPassword, confirmPassword)
      setPasswordMsg(res.message)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordMsg('Failed to change password')
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await deleteAccount(deletePassword)
      logout()
      navigate('/login')
    } catch {
      setDeleting(false)
    }
  }

  function getInitials() {
    return `${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`.toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-8">
        <p className="text-text-muted">Unable to load profile</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          {isViewingOther ? 'User Profile' : 'Profile'}
        </h1>
        <p className="text-text-secondary mt-1">
          {isViewingOther ? 'Viewing another user\'s profile' : 'Manage your account settings'}
        </p>
      </div>

      <div className="card p-6 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-cyan/20 flex items-center justify-center text-accent text-xl font-bold border border-accent/20">
            {getInitials()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{profile.first_name} {profile.last_name}</h2>
            <p className="text-sm text-text-muted">{profile.email}</p>
            <span className="badge badge-cyan mt-1">{profile.user_type}</span>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Last Name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            {!isViewingOther && (
              <button onClick={() => setEditing(true)} className="btn-primary">Edit Profile</button>
            )}
            {isStaff && !isViewingOther && (
              <button onClick={() => navigate(`/profile?userId=${currentUser?.id}`)} className="btn-specular">
                View as Staff
              </button>
            )}
          </div>
        )}
      </div>

      {!isViewingOther && (
        <>
          <div className="card p-6 animate-fade-in-up stagger-2">
            <h3 className="text-base font-semibold text-text-primary mb-4">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Current Password</label>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
              </div>
              {passwordMsg && (
                <p className={`text-xs ${passwordMsg.includes('Failed') || passwordMsg.includes('match') ? 'text-crimson' : 'text-success'}`}>
                  {passwordMsg}
                </p>
              )}
              <button type="submit" className="btn-primary">Update Password</button>
            </form>
          </div>

          <div className="card p-6 animate-fade-in-up stagger-3 border-crimson/20">
            <h3 className="text-base font-semibold text-crimson mb-2">Danger Zone</h3>
            <p className="text-sm text-text-muted mb-4">Once you delete your account, there is no going back. Please be certain.</p>
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)} className="px-4 py-2 rounded-xl border border-crimson/40 text-crimson text-sm font-medium hover:bg-crimson/10 transition-colors">
                Delete Account
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Type DELETE to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Your password"
                    className="input"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowDelete(false); setDeleteConfirm(''); setDeletePassword(''); }} className="btn-ghost">Cancel</button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== 'DELETE' || !deletePassword || deleting}
                    className="px-4 py-2 rounded-xl bg-crimson text-white text-sm font-medium hover:bg-crimson/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
