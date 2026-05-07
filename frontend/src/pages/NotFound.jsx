import { Link } from 'react-router-dom';
import { MdHome } from 'react-icons/md';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
    <p className="text-8xl font-black text-gray-100 select-none">404</p>
    <h1 className="text-2xl font-bold text-gray-800 -mt-4 mb-2">Page not found</h1>
    <p className="text-gray-500 text-sm mb-6">The page you're looking for doesn't exist.</p>
    <Link to="/" className="btn-primary">
      <MdHome className="h-4 w-4" />
      Go Home
    </Link>
  </div>
);

export default NotFound;
