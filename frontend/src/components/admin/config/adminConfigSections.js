import { MdCategory, MdInsights, MdPeople } from 'react-icons/md';
import EmployeeCategoriesSection from './EmployeeCategoriesSection';
import EmployeeManagementSection from './EmployeeManagementSection';
import BiDashboardSettingsSection from './BiDashboardSettingsSection';

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
    id: 'bi-dashboards',
    label: 'BI Dashboards',
    description: 'Season comparison and analytics portal options.',
    Icon: MdInsights,
    Component: BiDashboardSettingsSection,
  },
];

export function getConfigSection(id) {
  return ADMIN_CONFIG_SECTIONS.find((s) => s.id === id) ?? ADMIN_CONFIG_SECTIONS[0];
}
