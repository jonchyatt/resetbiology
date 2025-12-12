import { redirect } from 'next/navigation';

// Redirect from old URL to new URL
export default function VisionHealingRedirect() {
  redirect('/vision-training');
}
