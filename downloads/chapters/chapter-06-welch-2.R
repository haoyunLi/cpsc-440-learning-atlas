# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: welch
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Independent normal-population studies under the true null: both means are zero.
RNGkind("Mersenne-Twister","Inversion","Rejection")
set.seed(607440)
B <- 20000
alpha <- .05
settings <- data.frame(n1=c(8,20,8,8),n2=c(32,20,32,32),
                       sigma1=c(1,3,3,1),sigma2=c(1,1,1,3))
rows <- lapply(seq_len(nrow(settings)),function(i) {
  n1 <- settings$n1[i]
  n2 <- settings$n2[i]
  sigma1 <- settings$sigma1[i]
  sigma2 <- settings$sigma2[i]
  x <- matrix(rnorm(n1*B,mean=0,sd=sigma1),nrow=n1)
  y <- matrix(rnorm(n2*B,mean=0,sd=sigma2),nrow=n2)
  mx <- colMeans(x)
  my <- colMeans(y)
  vx <- colSums(sweep(x,2,mx,"-")^2)/(n1-1)
  vy <- colSums(sweep(y,2,my,"-")^2)/(n2-1)
  sp2 <- ((n1-1)*vx+(n2-1)*vy)/(n1+n2-2)
  t_pooled <- (mx-my)/sqrt(sp2*(1/n1+1/n2))
  p_pooled <- 2*pt(-abs(t_pooled),df=n1+n2-2)
  a <- vx/n1
  b <- vy/n2
  df_welch <- (a+b)^2/(a^2/(n1-1)+b^2/(n2-1))
  t_welch <- (mx-my)/sqrt(a+b)
  p_welch <- 2*pt(-abs(t_welch),df=df_welch)
  # The course's c-based df formula is algebraically identical.
  c_weight <- a/(a+b)
  df_c <- 1/(c_weight^2/(n1-1)+(1-c_weight)^2/(n2-1))
  stopifnot(max(abs(df_c-df_welch))<1e-10,
            abs(p_pooled[1]-t.test(x[,1],y[,1],var.equal=TRUE)$p.value)<1e-12,
            abs(p_welch[1]-t.test(x[,1],y[,1],var.equal=FALSE)$p.value)<1e-12)
  # Apply both prespecified procedures to the same simulated studies.
  counts <- c(sum(p_pooled<alpha),sum(p_welch<alpha))
  rate <- counts/B
  data.frame(n1=n1,n2=n2,sigma1=sigma1,sigma2=sigma2,
             method=c("pooled","Welch"),rejections=counts,B=B,
             rejection_rate=rate,MCSE=sqrt(rate*(1-rate)/B),
             true_variance=sigma1^2/n1+sigma2^2/n2,
             expected_pooled_SE2=((n1-1)*sigma1^2+(n2-1)*sigma2^2)/
                                 (n1+n2-2)*(1/n1+1/n2))
})
result <- do.call(rbind,rows)
print(result,row.names=FALSE,digits=8)
# Check bookkeeping, not an assertion that every rate must be exactly .05.
stopifnot(all(result$rejections>=0),all(result$rejections<=B),
          all(is.finite(result$MCSE)),all(result$MCSE>=0))
