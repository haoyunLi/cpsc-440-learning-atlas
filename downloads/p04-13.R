# Original transfer data, distinct from the lesson's 200-record table.
claims <- matrix(c(12,8,4,28,32,36),nrow=2,byrow=TRUE,
                 dimnames=list(status=c("fraud","nonfraud"),
                               policy=c("fire","auto","theft")))
print(addmargins(claims))
n <- sum(claims)
n_fraud <- sum(claims["fraud",])
n_fire <- sum(claims[,"fire"])
n_joint <- claims["fraud","fire"]
p_fire_given_fraud <- n_joint/n_fraud
p_fraud_given_fire <- n_joint/n_fire
p_joint <- n_joint/n
product <- (n_fraud/n)*(n_fire/n)
# These probabilities concern equal sampling from this fixed list.
independent <- isTRUE(all.equal(p_joint,product))
answer <- 1L
print(c(fire_given_fraud=p_fire_given_fraud,
        fraud_given_fire=p_fraud_given_fire,joint=p_joint,
        product_of_marginals=product,independent=independent,
        zero_based_answer=answer))
stopifnot(n==120,n_fraud==24,n_fire==40,
          abs(p_fire_given_fraud-.50)<1e-12,
          abs(p_fraud_given_fire-.30)<1e-12,
          abs(p_joint-.10)<1e-12,abs(product-1/15)<1e-12,
          !independent)
