const url=new URL(location.href); const data=url.searchParams.get('data');
if(data){
  const f=document.getElementById('f'); f.action='https://money.idram.am/payment.aspx'; f.innerHTML=`<input type="hidden" name="EDP_PRECHECK" value="TRUE"><input type="hidden" name="EDP_CHECKSUM" value="${data}">`; f.submit();
}
