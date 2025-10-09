import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

export function Landing() {

  const navigate = useNavigate()

  function handlelogout() {
    googleLogout();
    console.log("logout successfully");
  }

  return (
    <>   
        <GoogleLogin
            onSuccess={credentialResponse => {
                console.log(credentialResponse);
                console.log(jwtDecode(credentialResponse.credential));
                navigate('/home')
            }}
            onError={() => {
                console.log('Login Failed')
            }}
            auto_select={true}
        />
    </>
  );
}