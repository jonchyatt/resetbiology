import { redirect } from 'next/navigation'

// /modules/foundation, /integration and /mastery were never real pages; the
// guided audio library lives at /modules with those groupings inside it.
export default function ModuleCategoryRedirect() {
  redirect('/modules')
}
