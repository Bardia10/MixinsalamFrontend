import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { mixinApi } from '../services/api/mixin'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (url: string, token: string) => void
  type: 'mixin' | 'basalam'
}

function Modal({ isOpen, onClose, onSubmit, type }: ModalProps) {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-semibold mb-4">
          Connect to {type === 'mixin' ? 'Mixin' : 'Basalam'}
        </h2>
        {type === 'mixin' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g., api.mixin.ir"
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Mixin access token"
                className="w-full p-2 border rounded"
              />
            </div>
          </>
        )}
        <button
          onClick={() => onSubmit(url, token)}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Connect
        </button>
      </div>
    </div>
  )
}

function CredentialsPage() {
  const [isMixinModalOpen, setIsMixinModalOpen] = useState(false)
  const navigate = useNavigate()
  const { setMixinCredentials, setBasalamCredentials, isAuthenticated, mixinCredentials, basalamCredentials } = useAuthStore()

  // Add effect to handle URL parameters
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const basalamConnected = urlParams.get('basalam_connected')
    const error = urlParams.get('error')

    if (basalamConnected === 'true') {
      alert('Successfully connected to Basalam!')
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (error) {
      let errorMessage = 'Failed to connect to Basalam'
      switch (error) {
        case 'basalam_unauthorized':
          errorMessage = 'Authentication failed. Please check your Basalam credentials and try again.'
          break
        case 'basalam_server_error':
          errorMessage = 'Basalam server is currently unavailable. Please try again later.'
          break
        case 'basalam_forbidden':
          errorMessage = 'Access denied. Please check your permissions.'
          break
        case 'basalam_token_failed':
          errorMessage = 'Failed to get access token. Please try again.'
          break
        default:
          errorMessage = `Failed to connect to Basalam: ${error}`
      }
      alert(errorMessage)
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleMixinConnect = async (url: string, token: string) => {
    try {
      console.log('Attempting to connect with:', { url, token })
      const data = await mixinApi.validateCredentials(url, token)
      console.log('Received data from API:', data)
      
      if (data && data.url && data.access_token) {
        setMixinCredentials({ 
          url: data.url, 
          access_token: data.access_token 
        })
        setIsMixinModalOpen(false)
        alert('Successfully connected to Mixin!')
        window.location.reload()
      } else {
        console.error('Invalid response format:', data)
        throw new Error('Invalid response format from server')
      }
    } catch (error: any) {
      console.error('Connection error:', error)
      alert(error.message || 'Failed to connect to Mixin. Please check your credentials.')
    }
  }

  const handleBasalamConnect = () => {
    sessionStorage.setItem('shouldReloadAfterBasalam', 'true')
    
    // Add message listener for the new tab
    const messageHandler = (event: MessageEvent) => {
      console.log('Message received from:', event.origin);
      console.log('Message data:', event.data);
      
      // During testing, accept messages from any origin
      console.log('Processing message...');
      
      // Check if the response has the expected tokens
      const { access_token, refresh_token, vendor_id } = event.data;
      console.log('Extracted tokens:', { access_token, refresh_token, vendor_id });
      
      if (access_token) {
        console.log('Setting Basalam credentials...');
        setBasalamCredentials({
          access_token,
          refresh_token,
          vendor_id
        });
        
        // Verify credentials were set
        const currentCredentials = useAuthStore.getState().basalamCredentials;
        console.log('Current Basalam credentials after setting:', currentCredentials);
        
        // Remove the listener after successful connection
        window.removeEventListener('message', messageHandler);
        // Show success message
        alert('Successfully connected to Basalam!');
        // Force a re-render
        window.location.reload();
      } else {
        console.error('No access token in response');
      }
    };

    // Remove any existing listeners to prevent duplicates
    window.removeEventListener('message', messageHandler);
    
    // Add the event listener
    window.addEventListener('message', messageHandler);
    console.log('Message listener added');

    // Open Basalam SSO in new tab
    const basalamUrl = 'https://basalam.com/accounts/sso?client_id=1083&scope=vendor.profile.read%20vendor.product.write%20customer.profile.read%20vendor.product.read&redirect_uri=https://fastapi-bardia.chbk.app/basalam/client/get-user-access-token/&state=management-test';
    console.log('Opening Basalam URL:', basalamUrl);
    const newWindow = window.open(basalamUrl, '_blank');
    
    // Add a fallback check
    if (newWindow) {
      const checkWindow = setInterval(() => {
        if (newWindow.closed) {
          console.log('Basalam window was closed');
          clearInterval(checkWindow);
          // Check if we have credentials
          const currentCredentials = useAuthStore.getState().basalamCredentials;
          if (!currentCredentials) {
            console.log('No credentials found after window closed');
          } else {
            console.log('Credentials found after window closed:', currentCredentials);
            // Force a re-render if we have credentials
            window.location.reload();
          }
        }
      }, 1000);
    }
  }

  const handleContinue = () => {
    if (isAuthenticated()) {
      navigate('/home')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6">Connect Your Accounts</h1>
        
        <div className="space-y-4">
          <button
            onClick={() => setIsMixinModalOpen(true)}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Connect Mixin
          </button>
          
          <button
            onClick={handleBasalamConnect}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
          >
            Connect Basalam
          </button>
          
          <button
            onClick={handleContinue}
            disabled={!isAuthenticated()}
            className={`w-full py-2 rounded ${
              isAuthenticated()
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>

      <Modal
        isOpen={isMixinModalOpen}
        onClose={() => setIsMixinModalOpen(false)}
        onSubmit={handleMixinConnect}
        type="mixin"
      />
    </div>
  )
}

export default CredentialsPage