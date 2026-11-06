means <- c(12,14,19,16); n <- rep(5,4)
w <- c(0,.5,0,.5); mse <- 8; df <- 16
estimate <- sum(w*means)
se <- sqrt(mse*sum(w^2/n))
t <- (estimate-17)/se
p <- pt(t,df)
print(c(estimate=estimate,se=se,df=df,t=t,p_left=p))
stopifnot(abs(p-.019972359587)<1e-10)
