import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

export function Landing() {
  return (
    <>   
        <GoogleLogin
            onSuccess={credentialResponse => {
                console.log(credentialResponse);
                console
            }}
            onError={() => {
                console.log('Login Failed');
            }}
        />
    </>
  );
}