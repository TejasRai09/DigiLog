import { MdCategory, MdHistory, MdInsights, MdPeople, MdCalendarToday } from 'react-icons/md';
import EmployeeCategoriesSection from './EmployeeCategoriesSection';
import EmployeeManagementSection from './EmployeeManagementSection';
import BiDashboardSettingsSection from './BiDashboardSettingsSection';
import SeasonMappingSection from './SeasonMappingSection';
import AuditLogSection from './AuditLogSection';

/**
 * Registry of admin Config sections. Add new entries here to expose
 * additional settings panels without restructuring the Config page.
 */
export const ADMIN_CONFIG_SECTIONS = [
  {
    id: 'employees',
    label: 'Employees',
    description: 'Accounts, roles, mappings, and activation emails.',
    Icon: MdPeople,
    Component: EmployeeManagementSection,
  },
  {
    id: 'categories',
    label: 'Employee Categories',
    description: 'Department options shown in the employee creation form.',
    Icon: MdCategory,
    Component: EmployeeCategoriesSection,
  },
  {
    id: 'season-mapping',
    label: 'Season Mapping',
    description: 'Manage seasons and their exact start/end dates for BI filtering.',
    Icon: MdCalendarToday,
    Component: SeasonMappingSection,
  },
  {
    id: 'bi-dashboards',
    label: 'BI Dashboards',
    description: 'Season comparison and analytics portal options.',
    Icon: MdInsights,
    Component: BiDashboardSettingsSection,
  },
  {
    id: 'audit-log',
    label: 'Audit & Activity',
    description: 'Detailed records of create, update, and delete actions from DigiLog.',
    Icon: MdHistory,
    Component: AuditLogSection,
  },
];

export function getConfigSection(id) {
  return ADMIN_CONFIG_SECTIONS.find((s) => s.id === id) ?? ADMIN_CONFIG_SECTIONS[0];
}
