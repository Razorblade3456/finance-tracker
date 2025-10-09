import { GoogleLogin } from "@react-oauth/google";

export function Landing() {
  return (
    <>   
        <GoogleLogin
            onSuccess={credentialResponse => {
                console.log(credentialResponse);
            }}
            onError={() => {
                console.log('Login Failed');
            }}
        />
    </>
  );
}