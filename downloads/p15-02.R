t <- 3; b <- 4
ss_treatment <- 48; ss_block <- 60; ss_error <- 12
ms_treatment <- ss_treatment/(t-1)
mse_rcbd <- ss_error/((t-1)*(b-1))
mse_crd <- (ss_block+ss_error)/(t*b-t)
answer <- ms_treatment/mse_crd
c(F_RCBD=ms_treatment/mse_rcbd,F_CRD=answer)
