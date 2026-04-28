/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, testConnection } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety net: ensure loading screen clears even if Firebase hangs
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    let unsubscribeProfile: (() => void) | null = null;
    
    // Test basic connection
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        
        // Initial setup for new users (Fire and forget, don't block the listener)
        getDoc(profileRef).then(async (snap) => {
          if (!snap.exists()) {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(profileRef, {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'Technician',
              state: 'BE',
              hourlyRate: 15.00,
              weeklyContractHours: 40,
              vacationDaysPerYear: 28,
              role: u.email === 'dadakhalander34@gmail.com' ? 'admin' : 'employee',
              createdAt: Date.now()
            });
          }
        }).catch(err => console.error("Profile check failed:", err));

        // Persistent listener
        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          if (auth.currentUser) {
            console.error("Profile onSnapshot error:", error);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
