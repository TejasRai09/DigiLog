import { MdCategory, MdFactCheck, MdHistory, MdInsights, MdPeople, MdCalendarToday } from 'react-icons/md';
import EmployeeCategoriesSection from './EmployeeCategoriesSection';
import EmployeeManagementSection from './EmployeeManagementSection';
import BiDashboardSettingsSection from './BiDashboardSettingsSection';
import SeasonMappingSection from './SeasonMappingSection';
import AuditLogSection from './AuditLogSection';
import MaintenanceHistoryApprovalSection from './MaintenanceHistoryApprovalSection';

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
    description: 'Calculation constants. Compare seasons come from Season Mapping.',
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
  {
    id: 'maintenance-history-approval',
    label: 'Maintenance History Approval',
    description: 'HOD email approval for Sugar House and Power Plant maintenance history.',
    Icon: MdFactCheck,
    Component: MaintenanceHistoryApprovalSection,
  },
];

export function getConfigSection(id) {
  return ADMIN_CONFIG_SECTIONS.find((s) => s.id === id) ?? ADMIN_CONFIG_SECTIONS[0];
}
