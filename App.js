import { AuthProvider } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';

export default function App() {
  return <AuthProvider><AuthNavigator /></AuthProvider>;
}
