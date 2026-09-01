import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminConfigLayout from '../../components/admin/AdminConfigLayout';
import {
  getConfigSection,
} from '../../components/admin/config/adminConfigSections';

const AdminConfig = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const initialSection = getConfigSection(sectionFromUrl).id;
  const [activeSectionId, setActiveSectionId] = useState(initialSection);

  useEffect(() => {
    if (!sectionFromUrl) {
      setSearchParams({ section: getConfigSection(null).id }, { replace: true });
      return;
    }
    const next = getConfigSection(sectionFromUrl).id;
    setActiveSectionId(next);
  }, [sectionFromUrl, setSearchParams]);

  const ActiveSection = useMemo(() => {
    return getConfigSection(activeSectionId).Component;
  }, [activeSectionId]);

  const handleSectionChange = (id) => {
    setActiveSectionId(id);
    setSearchParams({ section: id }, { replace: true });
  };

  return (
    <AdminConfigLayout activeSectionId={activeSectionId} onSectionChange={handleSectionChange}>
      <ActiveSection key={activeSectionId} />
    </AdminConfigLayout>
  );
};

export default AdminConfig;
