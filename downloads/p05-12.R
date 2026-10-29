truth <- c("H0 true","H0 false")
decision <- c("Reject H0","Fail to reject H0")
matrix(c("Type I error","Correct decision",
         "Correct decision","Type II error"),nrow=2,
       dimnames=list(truth,decision))
