import React, { useMemo, useState } from 'react';
import { Page } from '../types';
import SettingsGroup from '../components/SettingsGroup';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import { TextInput } from '../components/ui/Fields';
import { EmptyState } from '../components/ui/States';
import { HELP_SECTIONS, searchHelp } from '../utils/helpContent';

interface DocumentationProps {
  setCurrentPage: (page: Page) => void;
}

const Documentation: React.FC<DocumentationProps> = ({ setCurrentPage }) => {
  const [search, setSearch] = useState('');
  const sections = useMemo(() => searchHelp(HELP_SECTIONS, search), [search]);

  return (
    <div className="space-y-6">
      <SettingsSubpageHeader title="Help" setCurrentPage={setCurrentPage} />
      <TextInput label="Search help" className="max-w-xl" value={search} onChange={setSearch} />
      {sections.length > 0 ? sections.map(section => (
        <SettingsGroup key={section.id} id={section.id} title={section.title}>
          <dl className="space-y-3">
            {section.points.map(point => (
              <div key={point.title}>
                <dt className="type-body-strong text-ink">{point.title}</dt>
                <dd className="type-body mt-0.5 text-muted">{point.text}</dd>
              </div>
            ))}
          </dl>
        </SettingsGroup>
      )) : (
        <EmptyState icon="search" title="Nothing found" description="Try another word." />
      )}
    </div>
  );
};

export default Documentation;
