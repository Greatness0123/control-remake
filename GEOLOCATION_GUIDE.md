# Geolocation Guide

The geolocation feature is currently disabled in the application to ensure reliability during attendance taking.

## How to Re-enable Geolocation

To re-enable location-based restrictions for attendance, follow these steps:

1. **Update `NewAttendanceScreen.jsx`**:
   - Change the initial state of `useLocation` from `false` to `true`:
     ```javascript
     const [useLocation, setUseLocation] = useState(true);
     ```

2. **Update `LecturerBroadcast.jsx`** (if still in use):
   - Change the initial state of `useLocation` to `true`.

3. **Check `utils/locationHelpers.js`**:
   - Ensure the logic for `getCurrentLocation` is working correctly for your target platforms (Web, Android, iOS).

4. **Verify Permissions**:
   - Make sure you have the necessary location permissions configured in `app.json` (for Expo) and that the user is prompted to grant them.

By default, the app now allows students to join broadcasts regardless of their physical location to avoid issues with GPS accuracy in certain environments.
