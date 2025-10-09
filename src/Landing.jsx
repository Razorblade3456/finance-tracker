import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

export function Landing() {

  const navigate = useNavigate()

  return (
    <>   
        <GoogleLogin
            onSuccess={credentialResponse => {
                console.log(credentialResponse);
                console.log(jwtDecode(credentialResponse.credential));
                navigate('/home')
            }}
            onError={() => {
                console.log('Login Failed');
            }}
        />
    </>
  );
}