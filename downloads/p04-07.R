pA <- 0.40; pB <- 0.50; pAB <- 0.20
c(union=pA+pB-pAB,conditional_A_given_B=pAB/pB,
  independent=isTRUE(all.equal(pAB,pA*pB)),mutually_exclusive=(pAB==0))
