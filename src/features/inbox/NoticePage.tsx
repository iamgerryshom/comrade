import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { EmptyState, PageSkeleton } from '@/components/common'
import { getServices } from '@/services'
import { NoticeDetail } from './NoticeDetail'

/** Full-screen notice (phones, deep links /notice/{id} and notification taps). */
export function NoticePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/inbox'))}>
        <ArrowLeft /> Back
      </Button>
      <Card className="p-4 sm:p-6">{id && <NoticeDetail notificationId={id} />}</Card>
    </div>
  )
}

/** /n/{shortCode}: the "Ref:K7Q2" from an SMS opens the full notice. */
export function ShortCodePage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!code) return
    void getServices()
      .notifications.findByShortCode(code)
      .then((id) => (id ? navigate(`/notice/${id}`, { replace: true }) : setMissing(true)))
  }, [code, navigate])
  if (missing) return <EmptyState icon={SearchX} title={`No notice with reference ${code}`} description="Check the code in your SMS, or look in your inbox." />
  return <PageSkeleton />
}
