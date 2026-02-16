import { Redirect } from 'expo-router';

/** Dummy screen – the FAB tab button never actually navigates here. */
export default function FabAction() {
  return <Redirect href="/nutrition" />;
}
