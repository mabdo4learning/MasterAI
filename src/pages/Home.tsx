import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { SUBJECTS, findSubject } from '../subjects';
import { getDashboard, type Dashboard } from '../lib/api';
import { weekStart } from '../lib/time';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import Banner from '../components/dashboard/Banner';
import StatTiles from '../components/dashboard/StatTiles';
import ActivityChart from '../components/dashboard/ActivityChart';
import SubjectProgress from '../components/dashboard/SubjectProgress';
import RecentActivity from '../components/dashboard/RecentActivity';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function Home() {
  const toast = useToast();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => toast(`Couldn't load dashboard: ${e.message}`, 'error'));
  }, [toast]);

  const sessions = data?.sessions ?? null;
  const isStarted = (s: { topic: string; noteCount: number; imageCount: number; documentCount: number }) =>
    !!s.topic.trim() || s.noteCount > 0 || s.imageCount > 0 || s.documentCount > 0;

  const started = sessions ? sessions.filter(isStarted).length : null;
  const totalNotes = sessions ? sessions.reduce((n, s) => n + s.noteCount, 0) : null;
  const totalImages = sessions ? sessions.reduce((n, s) => n + s.imageCount, 0) : null;
  const activeSubjects = sessions ? new Set(sessions.filter(isStarted).map((s) => s.subjectSlug)).size : null;

  const thisWeek = weekStart(new Date()).getTime();
  const addedThisWeek = (kind: 'note' | 'image') =>
    data?.activity.filter((a) => a.kind === kind && new Date(a.createdAt).getTime() >= thisWeek).length ?? 0;

  const latest = data?.recent[0];
  const latestSubject = latest && findSubject(latest.subjectSlug);
  const resume = latestSubject ? { subject: latestSubject, sessionNumber: latest.sessionNumber } : null;

  return (
    <div className="page dashboard">
      <Banner started={started} total={sessions?.length ?? 0} resume={resume} />

      <StatTiles
        stats={[
          {
            label: 'Sessions covered',
            icon: 'calendar',
            value: started,
            detail: `of ${sessions?.length ?? 0} sessions`,
          },
          {
            label: 'Notes',
            icon: 'note',
            value: totalNotes,
            detail: `+${addedThisWeek('note')} this week`,
          },
          {
            label: 'Images',
            icon: 'image',
            value: totalImages,
            detail: `+${addedThisWeek('image')} this week`,
          },
          {
            label: 'Subjects started',
            icon: 'check',
            value: activeSubjects,
            detail: `of ${SUBJECTS.length} subjects`,
          },
        ]}
      />

      <div className="dash-row">
        <ActivityChart activity={data?.activity ?? null} />
        <RecentActivity items={data?.recent ?? null} />
      </div>

      <SubjectProgress sessions={sessions} />

      <div className="section-title">
        <h2>All subjects</h2>
        <span className="muted small">{SUBJECTS.length} subjects</span>
      </div>

      <main className="subject-grid">
        {SUBJECTS.map((s) => {
          const own = sessions?.filter((x) => x.subjectSlug === s.slug);
          const notes = own?.reduce((n, x) => n + x.noteCount, 0) ?? 0;
          const images = own?.reduce((n, x) => n + x.imageCount, 0) ?? 0;
          return (
            <Link
              key={s.slug}
              to={`/subjects/${s.slug}`}
              className="card subject-card"
              style={{ '--accent': s.color } as CSSProperties}
            >
              <div className="subject-card-top">
                <span className="badge">{s.number}</span>
                {own && (
                  <span className="card-counts">
                    <span title={plural(notes, 'note')}>
                      <Icon name="note" size={14} />
                      {notes}
                    </span>
                    <span title={plural(images, 'image')}>
                      <Icon name="image" size={14} />
                      {images}
                    </span>
                  </span>
                )}
              </div>
              <h2>{s.title}</h2>
              <span className="open-link">
                Open sessions <Icon name="arrowRight" size={15} />
              </span>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
