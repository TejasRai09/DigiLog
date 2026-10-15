import { MdAssignment, MdCategory, MdFactCheck, MdHistory, MdInsights, MdNotes, MdPeople, MdCalendarToday } from 'react-icons/md';
import EmployeeCategoriesSection from './EmployeeCategoriesSection';
import EmployeeManagementSection from './EmployeeManagementSection';
import BiDashboardSettingsSection from './BiDashboardSettingsSection';
import SeasonMappingSection from './SeasonMappingSection';
import AuditLogSection from './AuditLogSection';
import MaintenanceHistoryApprovalSection from './MaintenanceHistoryApprovalSection';
import MaintenanceNotesApprovalSection from './MaintenanceNotesApprovalSection';
import FormsApprovalSection from './FormsApprovalSection';

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
    description: 'HOD email approval for Sugar House, Power Plant, and Production House maintenance history.',
    Icon: MdFactCheck,
    Component: MaintenanceHistoryApprovalSection,
  },
  {
    id: 'maintenance-notes-approval',
    label: 'Maintenance Notes Approval',
    description: 'Assign the HOD who can close Maintenance Notes for each plant.',
    Icon: MdNotes,
    Component: MaintenanceNotesApprovalSection,
  },
  {
    id: 'forms-approval',
    label: 'Forms Approval',
    description: 'HOD approval for Forms Hub cards and individual forms. Off until you enable a card or form.',
    Icon: MdAssignment,
    Component: FormsApprovalSection,
  },
];

export function getConfigSection(id) {
  return ADMIN_CONFIG_SECTIONS.find((s) => s.id === id) ?? ADMIN_CONFIG_SECTIONS[0];
}
