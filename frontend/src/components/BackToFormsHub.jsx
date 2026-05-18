import { Link } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';

const BackToFormsHub = ({ className = 'mb-6' }) => (
  <Link
    to="/forms-hub"
    className={`flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors ${className}`}
  >
    <MdArrowBack className="h-4 w-4" />
    Back to Forms Hub
  </Link>
);

export default BackToFormsHub;
